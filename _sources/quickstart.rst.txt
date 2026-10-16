5 分钟快速入门
===============

最短 Python 调用
----------------

内置 Poisson、Burgers 和双隧道二维模型可以直接用简称选择：

.. code-block:: python

   import openpinn as op

   result = op.solve(
       "poisson",          # 也可以写 burgers 或 tunnel_model1
       method="fourier",  # 方法大类
       variant="random_fourier",  # 该大类中的具体实现
       steps=5000,
   )
   print(result.output_dir)

普通 PINN 使用 ``method="baseline"``。查看全部名称：

.. code-block:: bash

   python -m openpinn list-methods
   python -m openpinn list-methods --family adaptive_sampling

网页配置生成器
--------------

不想手写方法参数时，直接打开 :doc:`method_configurator`。选择问题，设置训练
步数和终端输出间隔，勾选一个或多个方法，修改页面显示的专用超参数，然后点击
“复制代码”。页面生成的是完整 Python 文件，不需要再和另一段代码手工拼接。

例如，Fourier 特征与 ReLoBRaLo 可以写成：

.. code-block:: python

   result = op.solve(
       "poisson",
       methods=[
           op.method("fourier", "random_fourier", num_frequencies=16),
           op.method("adaptive_weights", "relobralo", temperature=0.1),
       ],
       steps=5000,
   )

每个 ``op.method(...)`` 只包含该方法自己的超参数。控制同一功能位置的冲突组合
会在网页和 Python 入口中同时被拒绝。

双隧道二维模型的最短链路检查只需把问题简称和步数改成：

.. code-block:: python

   result = op.solve(
       "tunnel_model1",
       method="adaptive_weights",
       variant="self_adaptive",
       steps=5,
   )

完整方程、双圆孔几何、可修改参数、20,000 步论文预算和当前复现边界见
:doc:`tunnel_model1`。

可直接复制的方法简称
----------------------

``method`` 选择方法大类，``variant`` 选择该大类中的具体算法。
每个大类有一个向后兼容的默认变体；自适应采样和损失平衡大类已经包含多个
可独立选择、经过测试的二级变体：

.. openpinn-method-catalog::
   :caption: OpenPINN 方法简称表（点击 ``variant`` 查看详情）

例如，把最短代码中的两行替换为：

.. code-block:: python

   method="adaptive_sampling",
   variant="residual_adaptive",

就会使用残差自适应采样。省略 ``variant`` 时使用该大类的当前
默认变体；建议正式实验中明确写出两级简称，便于复现。

最短命令行调用
--------------

.. code-block:: bash

   python -m openpinn run --problem poisson --method fourier \
      --variant random_fourier --steps 5000

快速检查时将 ``--steps`` 改为 ``5``。输出有限且无异常只表示程序链路正常。

最短 YAML 调用
----------------

``configs/experiments/poisson_fourier.yaml`` 的核心只有三段：

.. code-block:: yaml

   problem:
     name: poisson

   method:
     name: fourier
     variant: random_fourier

   training:
     steps: 5000

运行：

.. code-block:: bash

   python -m openpinn run --config configs/experiments/poisson_fourier.yaml

临时短跑而不修改 YAML，可以增加 ``--steps 5``；它会覆盖文件中的
``training.steps``。

配置文件只负责“选什么、参数是多少”；真正的算法实现位于 ``src/openpinn/``。

每次运行保存什么
----------------

统一入口会为每次运行建立独立目录，并保存：

* ``config.yaml``：已经展开的方法和问题设置；
* ``metrics.json``：有参考解时保存相对 L2、RMSE、MAE、最大误差和 R2；
  没有参考场的双隧道问题保存 PDE、边界、初值和孔压物理指标；
* ``compute_ledger.json``：用时、设备、参数量和优化器诊断；
* ``history.csv`` 与 ``predictions.npz``：训练曲线和预测；
* ``result.svg``：Poisson 解/误差图、Burgers 一维时间切片，或双隧道二维模型的物理坐标
  二维孔压场；双隧道还会生成 ``diagnostics.svg``，显示残差场、孔压剖面和
  平均孔压消散；
* ``loss.svg``：训练损失；
* ``checkpoint.pt``：模型与训练状态；
* ``failure_notes.md``：失败或结果解释边界；
* ``manifest.json``：文件大小和 SHA-256 清单。

下一步
------

* 想添加新控制方程：阅读 :doc:`custom_equation`；
* 想选择十种方法：阅读 :doc:`methods`；
* 想按表单选择和修改全部方法参数：打开 :doc:`method_configurator`；
* 想理解源码和配置为什么分开：阅读 :doc:`architecture`；
* 想做正式比较：先阅读 :doc:`validation`。
