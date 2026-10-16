多网络与区域分解：左右各学一段，界面再接起来
==================================================

.. openpinn-method-summary:: domain_decomposition two_subdomain

这是什么
----------

非均质 Poisson 的材料系数在 ``x=0`` 从 1 变成 4，精确解连续但左右斜率不同。
普通组用一个 MLP 学整个区间；分解组用两个小 MLP，左网络只负责 ``x<=0``，
右网络只负责 ``x>0``。在界面同时惩罚两个网络的解不连续和物理通量不连续。

放在哪里
----------

* 两子网络：``src/openpinn/models.py`` 的 ``DomainDecompositionPINN``；
* 界面损失：``src/openpinn/formulations.py`` 的 ``InterfaceStrongFormulation``；
* 统一调用：``model.name: domain_decomposition`` 与
  ``loss.formulation: interface_strong``；
* 对比入口：``examples/heterogeneous_poisson_domain_decomposition.py``。

依据与许可
----------

* 核心论文：Jagtap and Karniadakis, *Extended Physics-Informed
  Neural Networks (XPINNs): A Generalized Space-Time Domain Decomposition Based
  Deep Learning Framework for Nonlinear Partial Differential Equations*,
  Communications in Computational Physics 28 (2020) 2002--2041，DOI
  ``10.4208/cicp.OA-2020-0164``。
* 参考仓库：``https://github.com/AmeyaJagtap/XPINNs``，许可为 MIT。
* 本实现按区域分解和界面匹配概念独立编写，没有复制或改写仓库 ZIP 中的代码。

实现范围要说清
--------------

这是一维、两子域、单标量场的最小界面方法。它没有实现通用多维分区、多进程并行、
各子域独立超参数或论文的全部 XPINN 界面项，因此不宣称是完整 XPINN 框架。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "heterogeneous_poisson",
       method="domain_decomposition",
       variant="two_subdomain",
       steps=5000,
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.heterogeneous_poisson_domain_decomposition \
     --output-dir runs/heterogeneous_poisson_domain_decomposition_<timestamp>

公平对比
--------

两组使用同一个非均质 Poisson 问题、采样、32×3 的单网络/子网络宽深、Adam、
1500 步和随机种子。分解组由于有两个子网络，参数量约为普通组的两倍；
解连续与通量连续损失是方法本身必需的变化，因此两组的训练目标并不完全相同。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种完成 1500 步对比。两组均完成，
保存数值、左右子网络 checkpoint 和 SVG 都通过检查。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2 误差
     - PDE 残差 RMSE
     - 界面解跳
     - 界面通量跳
     - 训练时间
     - 参数量
   * - 单 MLP
     - 0.24177
     - 0.00220
     - 2.027e-6
     - 1.50159
     - 1.202 s
     - 2209
   * - 两子网络
     - 3.124e-4
     - 0.01127
     - 1.248e-4
     - 2.307e-4
     - 2.538 s
     - 4418

完整结果位于 ``results/methods/heterogeneous_poisson_domain_decomposition_20260826_120038/``。
两子网络将相对 L2 降低约三个数量级，将物理通量跳从 1.50 降到 2.31e-4，
明显修复了单一光滑 MLP 在材料界面处的通量错误。代价是参数翻倍、用时增加 1.336 秒，
且评价网格上的 PDE 残差比单 MLP 高。因此结论是“界面和解误差显著改善，
但并非所有指标和成本都更好”。

.. image:: /_static/methods/domain_decomposition.svg
   :alt: 非均质 Poisson 单网络与两子域网络对照
   :width: 100%

限制和失败记录
--------------

* 参数量不相同，必须与误差和时间一起阅读。
* 仅一个非均质小问题和固定种子，不作统计优越声明。
* 界面解跳和通量跳同时写入 ``metrics.json`` 和比较表；失败另存
  ``failure.json`` 和 ``failure_notes.md``。
