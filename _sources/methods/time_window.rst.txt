顺序时间窗：先学早期，再打开后期
===================================

.. openpinn-method-summary:: time_window causal_window

这是什么
----------

普通动态 PINN 从第一步就在全部 ``t in [0, 1]`` 采样。时间窗版先只在
``[0, 0.25]`` 训练，之后依次扩大到 ``[0, 0.50]``、``[0, 0.75]`` 和 ``[0, 1.00]``。
每次仍保留从初始时刻到当前上限的数据，避免只学新时间段而完全丢掉早期。

放在哪里
----------

* 时间窗采样器：``src/openpinn/sampling.py`` 的 ``TimeWindowSampler``；
* 统一调用：``sampling.name: time_window``；
* 时窗端点：``sampling.options.window_ends``；
* 对比入口：``examples/burgers_time_window.py``。

许可和专利边界
--------------

* 核心论文：Wang, Sankaran and Perdikaris,
  *Respecting causality for training physics-informed neural networks*,
  Computer Methods in Applied Mechanics and Engineering 421 (2024) 116813，
  DOI ``10.1016/j.cma.2024.116813``。
* 参考仓库 ``https://github.com/PredictiveIntelligenceLab/CausalPINNs`` 明确说明算法受
  宾夕法尼亚大学专利保护，代码/材料采用 CC BY-NC-SA 4.0，不当作可商用代码。
* 本项目没有复制、改写或启用该仓库的指数因果权重。这里是独立编写的通用
  时间域课程，不是论文专利算法的复刻。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "burgers", method="time_window", variant="causal_window", steps=5000
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.burgers_time_window \
     --output-dir runs/burgers_time_window_<timestamp>

公平对比
--------

两组使用相同 Burgers 问题、随机种子、512/64/64 个内部/边界/初值点、
64×4 MLP、损失、Adam 和 1500 步，都每 375 步重采样。普通组每个阶段都采样全时域；
时间窗组在三次更新中逐步打开后续时间。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种完成 1500 步对比。两组都运行完成，
时间窗组完成三次更新并到达 ``t=1``，保存数值、checkpoint、诊断与 SVG 均通过检查。
Cole–Hopf 参考解只用于训练后评价。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2
     - 最大绝对误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - 初值 RMSE
     - 训练时间
   * - 全时域均匀训练
     - 0.32292
     - 0.89356
     - 0.43321
     - 0.01493
     - 0.19706
     - 4.140 s
   * - 顺序时间窗
     - 0.37165
     - 1.07061
     - 0.36544
     - 0.04175
     - 0.22147
     - 4.319 s

.. image:: /_static/methods/time_window.svg
   :alt: Burgers 全时域训练与顺序时间窗的四时间片、误差和损失对比
   :width: 100%

完整结果位于 ``results/methods/burgers_time_window_reference_20260826/``。时间窗组的全域 PDE 残差
低了 0.06777，但相对 L2、最大误差、边界和初值 RMSE 都更高，用时也略长。
不宣称整体更优。尤其不能将本结果当作受专利保护的 CausalPINNs 因果损失算法的复现。

限制和失败记录
--------------

* 不能把本项结果写成对 CausalPINNs 论文方法的复现或验证。
* 四窗口是未调参的最小日程，仅一个随机种子，不作统计优越声明。
* 当前窗口、进度和随机状态保存进 checkpoint 和 ``sampling_diagnostics.json``；
  失败另存 ``failure.json`` 和 ``failure_notes.md``。
